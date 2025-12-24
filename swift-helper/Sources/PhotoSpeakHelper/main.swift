import Foundation
import Photos
import AppKit

// MARK: - JSON Structures

struct AlbumInfo: Codable {
    let id: String
    let title: String
    let count: Int
}

struct PhotoInfo: Codable {
    let id: String
    let filename: String
    let creationDate: String
    let width: Int
    let height: Int
    let thumbnailBase64: String?
}

struct PhotoDetail: Codable {
    let id: String
    let filename: String
    let creationDate: String
    let width: Int
    let height: Int
    let imageBase64: String
}

struct ErrorResponse: Codable {
    let error: String
}

// MARK: - Helpers

func outputJSON<T: Encodable>(_ value: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let data = try? encoder.encode(value),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    }
}

func outputError(_ message: String) {
    outputJSON(ErrorResponse(error: message))
}

let dateFormatter: DateFormatter = {
    let df = DateFormatter()
    df.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
    return df
}()

// MARK: - Authorization

func checkAuthorization() -> Bool {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

    switch status {
    case .authorized, .limited:
        return true
    case .notDetermined:
        // Request authorization - this should trigger the system prompt
        var granted = false
        let semaphore = DispatchSemaphore(value: 0)

        // Run on main thread to ensure UI prompt appears
        DispatchQueue.main.async {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                granted = (newStatus == .authorized || newStatus == .limited)
                semaphore.signal()
            }
        }

        // Run the run loop briefly to allow the prompt to appear
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.1))
        semaphore.wait()
        return granted
    case .denied, .restricted:
        return false
    @unknown default:
        return false
    }
}

// MARK: - Image Processing

func imageToBase64(_ image: NSImage, maxSize: CGFloat) -> String? {
    let size = image.size
    let scale = min(maxSize / size.width, maxSize / size.height, 1.0)
    let newSize = CGSize(width: size.width * scale, height: size.height * scale)

    let resized = NSImage(size: newSize)
    resized.lockFocus()
    image.draw(in: NSRect(origin: .zero, size: newSize))
    resized.unlockFocus()

    guard let tiffData = resized.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else {
        return nil
    }

    return jpegData.base64EncodedString()
}

func requestImage(for asset: PHAsset, targetSize: CGSize, synchronous: Bool = true) -> NSImage? {
    let options = PHImageRequestOptions()
    options.isSynchronous = synchronous
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .exact

    var result: NSImage?
    let semaphore = DispatchSemaphore(value: 0)

    PHImageManager.default().requestImage(
        for: asset,
        targetSize: targetSize,
        contentMode: .aspectFit,
        options: options
    ) { image, info in
        if let nsImage = image {
            result = nsImage
        }
        if synchronous == false {
            semaphore.signal()
        }
    }

    if !synchronous {
        semaphore.wait()
    }

    return result
}

// MARK: - Commands

func listAlbums() {
    guard checkAuthorization() else {
        outputError("Photos access not authorized. Please grant access in System Preferences > Privacy & Security > Photos.")
        exit(1)
    }

    var albums: [AlbumInfo] = []

    // Smart albums
    let smartAlbums = PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: .any, options: nil)
    smartAlbums.enumerateObjects { collection, _, _ in
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
        let assets = PHAsset.fetchAssets(in: collection, options: fetchOptions)

        if assets.count > 0, let title = collection.localizedTitle {
            albums.append(AlbumInfo(
                id: collection.localIdentifier,
                title: title,
                count: assets.count
            ))
        }
    }

    // User albums
    let userAlbums = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: nil)
    userAlbums.enumerateObjects { collection, _, _ in
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
        let assets = PHAsset.fetchAssets(in: collection, options: fetchOptions)

        if assets.count > 0, let title = collection.localizedTitle {
            albums.append(AlbumInfo(
                id: collection.localIdentifier,
                title: title,
                count: assets.count
            ))
        }
    }

    outputJSON(albums)
}

func listPhotos(albumId: String? = nil) {
    guard checkAuthorization() else {
        outputError("Photos access not authorized")
        exit(1)
    }

    let fetchOptions = PHFetchOptions()
    fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    fetchOptions.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
    fetchOptions.fetchLimit = 200 // Limit for performance

    let assets: PHFetchResult<PHAsset>

    if let albumId = albumId {
        let collections = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil)
        if let collection = collections.firstObject {
            assets = PHAsset.fetchAssets(in: collection, options: fetchOptions)
        } else {
            outputError("Album not found")
            exit(1)
        }
    } else {
        assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
    }

    var photos: [PhotoInfo] = []
    let thumbnailSize = CGSize(width: 300, height: 300)

    assets.enumerateObjects { asset, index, stop in
        let creationDate = asset.creationDate.map { dateFormatter.string(from: $0) } ?? ""

        // Get thumbnail
        var thumbnailBase64: String? = nil
        if let image = requestImage(for: asset, targetSize: thumbnailSize) {
            thumbnailBase64 = imageToBase64(image, maxSize: 300)
        }

        photos.append(PhotoInfo(
            id: asset.localIdentifier,
            filename: asset.originalFilename ?? "Unknown",
            creationDate: creationDate,
            width: asset.pixelWidth,
            height: asset.pixelHeight,
            thumbnailBase64: thumbnailBase64
        ))
    }

    outputJSON(photos)
}

func getPhoto(photoId: String) {
    guard checkAuthorization() else {
        outputError("Photos access not authorized")
        exit(1)
    }

    let assets = PHAsset.fetchAssets(withLocalIdentifiers: [photoId], options: nil)

    guard let asset = assets.firstObject else {
        outputError("Photo not found")
        exit(1)
    }

    let targetSize = CGSize(width: 1920, height: 1920)

    guard let image = requestImage(for: asset, targetSize: targetSize),
          let base64 = imageToBase64(image, maxSize: 1920) else {
        outputError("Failed to load image")
        exit(1)
    }

    let creationDate = asset.creationDate.map { dateFormatter.string(from: $0) } ?? ""

    let detail = PhotoDetail(
        id: asset.localIdentifier,
        filename: asset.originalFilename ?? "Unknown",
        creationDate: creationDate,
        width: asset.pixelWidth,
        height: asset.pixelHeight,
        imageBase64: base64
    )

    outputJSON(detail)
}

func getThumbnail(photoId: String) {
    guard checkAuthorization() else {
        outputError("Photos access not authorized")
        exit(1)
    }

    let assets = PHAsset.fetchAssets(withLocalIdentifiers: [photoId], options: nil)

    guard let asset = assets.firstObject else {
        outputError("Photo not found")
        exit(1)
    }

    let targetSize = CGSize(width: 300, height: 300)

    guard let image = requestImage(for: asset, targetSize: targetSize),
          let base64 = imageToBase64(image, maxSize: 300) else {
        outputError("Failed to load thumbnail")
        exit(1)
    }

    print("\"\(base64)\"")
}

// MARK: - Extension

extension PHAsset {
    var originalFilename: String? {
        let resources = PHAssetResource.assetResources(for: self)
        return resources.first?.originalFilename
    }
}

// MARK: - Main

let args = CommandLine.arguments

guard args.count >= 2 else {
    let help = """
    PhotoSpeak Helper - Access Apple Photos from command line

    Usage:
      PhotoSpeakHelper <command> [arguments]

    Commands:
      list-albums              List all photo albums
      list-photos [album-id]   List photos (optionally in a specific album)
      get-photo <photo-id>     Get full-size photo as base64
      get-thumbnail <photo-id> Get thumbnail as base64
    """
    print(help)
    exit(0)
}

let command = args[1]

switch command {
case "list-albums":
    listAlbums()

case "list-photos":
    let albumId = args.count > 2 ? args[2] : nil
    listPhotos(albumId: albumId)

case "get-photo":
    guard args.count > 2 else {
        outputError("Photo ID required")
        exit(1)
    }
    getPhoto(photoId: args[2])

case "get-thumbnail":
    guard args.count > 2 else {
        outputError("Photo ID required")
        exit(1)
    }
    getThumbnail(photoId: args[2])

default:
    outputError("Unknown command: \(command)")
    exit(1)
}
