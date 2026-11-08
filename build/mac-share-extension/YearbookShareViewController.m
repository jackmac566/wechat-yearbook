// Experimental macOS share target. Hand the staged ZIP to the app through
// LaunchServices, the same way a user opens a file in Finder.
#import <Cocoa/Cocoa.h>
#import <fcntl.h>
#import <sys/stat.h>
#import <unistd.h>

static NSString * const ZipType = @"public.zip-archive";
static NSString * const FileURLType = @"public.file-url";
static const off_t MaxZipBytes = 128 * 1024 * 1024;

static NSError *ImportError(NSString *message) {
    return [NSError errorWithDomain:@"cn.serkon.wechatyearbook.import" code:1
                           userInfo:@{NSLocalizedDescriptionKey: message}];
}

static NSURL *StageZip(NSURL *source, NSError **error) {
    BOOL scoped = [source startAccessingSecurityScopedResource];
    int descriptor = source.isFileURL ? open(source.fileSystemRepresentation, O_RDONLY | O_NONBLOCK | O_NOFOLLOW) : -1;
    NSData *data = nil;
    if (descriptor >= 0) {
        NSFileHandle *file = [[NSFileHandle alloc] initWithFileDescriptor:descriptor closeOnDealloc:YES];
        struct stat details;
        if (fstat(descriptor, &details) == 0 && S_ISREG(details.st_mode) && details.st_size >= 4 && details.st_size <= MaxZipBytes) {
            data = [file readDataUpToLength:(NSUInteger)details.st_size + 1 error:nil];
            if (data.length != (NSUInteger)details.st_size) data = nil;
        }
    }
    if (scoped) [source stopAccessingSecurityScopedResource];

    const unsigned char *header = data.bytes;
    if (data.length < 4 || memcmp(header, "PK\003\004", 4) != 0) {
        *error = ImportError(@"请分享不超过 128 MB 的微信聊天 ZIP 文件");
        return nil;
    }

    NSString *name = [@"wechat-yearbook-share-" stringByAppendingString:NSUUID.UUID.UUIDString];
    NSURL *directory = [[NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES]
                        URLByAppendingPathComponent:name isDirectory:YES];
    NSFileManager *manager = NSFileManager.defaultManager;
    if (![manager createDirectoryAtURL:directory withIntermediateDirectories:NO attributes:@{NSFilePosixPermissions: @0700} error:error]) {
        return nil;
    }
    NSURL *file = [directory URLByAppendingPathComponent:@"wechat-chat.zip" isDirectory:NO];
    if (![data writeToURL:file options:NSDataWritingAtomic error:error]) {
        [manager removeItemAtURL:directory error:nil];
        return nil;
    }
    return file;
}

@interface YearbookShareViewController : NSViewController
@property (nonatomic) BOOL hasStarted;
@end

@implementation YearbookShareViewController

- (void)loadView {
    NSView *view = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 1, 1)];
    view.alphaValue = 0;
    self.view = view;
    self.preferredContentSize = NSZeroSize;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    if (self.hasStarted) return;
    self.hasStarted = YES;

    NSExtensionContext *context = self.extensionContext;
    if (!context) return;
    NSMutableArray<NSItemProvider *> *providers = [NSMutableArray array];
    for (NSExtensionItem *item in context.inputItems) {
        if ([item isKindOfClass:NSExtensionItem.class] && item.attachments) {
            [providers addObjectsFromArray:item.attachments];
        }
    }
    if (providers.count != 1) {
        [context cancelRequestWithError:ImportError(@"每次请选择一个微信聊天 ZIP 文件")];
        return;
    }

    NSItemProvider *provider = providers.firstObject;
    void (^receive)(NSURL *, NSError *) = ^(NSURL *source, NSError *loadError) {
        // NSItemProvider removes its temporary source when this callback ends.
        NSError *error = loadError;
        NSURL *file = source ? StageZip(source, &error) : nil;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (file) [self openStagedFile:file context:context];
            else [context cancelRequestWithError:error ?: ImportError(@"无法读取共享的聊天文件")];
        });
    };
    if ([provider hasItemConformingToTypeIdentifier:ZipType]) {
        [provider loadFileRepresentationForTypeIdentifier:ZipType completionHandler:receive];
    } else if ([provider hasItemConformingToTypeIdentifier:FileURLType]) {
        [provider loadObjectOfClass:NSURL.class completionHandler:^(id<NSItemProviderReading> object, NSError *error) {
            receive([object isKindOfClass:NSURL.class] ? (NSURL *)object : nil, error);
        }];
    } else {
        [context cancelRequestWithError:ImportError(@"请分享微信聊天 ZIP 文件")];
    }
}

- (void)openStagedFile:(NSURL *)file context:(NSExtensionContext *)context {
    NSURL *appURL = NSBundle.mainBundle.bundleURL
        .URLByDeletingLastPathComponent
        .URLByDeletingLastPathComponent
        .URLByDeletingLastPathComponent;
    if (![appURL.pathExtension isEqualToString:@"app"]) {
        [NSFileManager.defaultManager removeItemAtURL:file.URLByDeletingLastPathComponent error:nil];
        [context cancelRequestWithError:ImportError(@"无法找到微信年轮应用")];
        return;
    }
    NSWorkspaceOpenConfiguration *configuration = NSWorkspaceOpenConfiguration.configuration;
    configuration.addsToRecentItems = NO;
    [NSWorkspace.sharedWorkspace openURLs:@[file] withApplicationAtURL:appURL configuration:configuration
                        completionHandler:^(NSRunningApplication *app, NSError *error) {
        if (error) {
            [NSFileManager.defaultManager removeItemAtURL:file.URLByDeletingLastPathComponent error:nil];
            [context cancelRequestWithError:error];
        } else {
            [context completeRequestReturningItems:nil completionHandler:nil];
        }
    }];
}

@end
