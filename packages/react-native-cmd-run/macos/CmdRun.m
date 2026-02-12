#import "CmdRun.h"
#import <React/RCTLog.h>

@implementation CmdRun {
    NSTask *_serverTask;
}

RCT_EXPORT_MODULE()

static void ConfigureTask(NSTask *task, NSString *command, NSArray *args, NSString *cwd)
{
    if ([command containsString:@"/"]) {
        [task setLaunchPath:command];
        [task setArguments:args ?: @[]];
    } else {
        [task setLaunchPath:@"/usr/bin/env"];
        NSMutableArray *resolvedArgs = [NSMutableArray arrayWithCapacity:(args.count + 1)];
        [resolvedArgs addObject:command];
        if (args) {
            [resolvedArgs addObjectsFromArray:args];
        }
        [task setArguments:resolvedArgs];
    }
    if (cwd) {
        [task setCurrentDirectoryPath:cwd];
    }
}

RCT_EXPORT_METHOD(execute:(NSString *)command
                  withArgs:(NSArray *)args
                  withCwd:(NSString *)cwd
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSTask *task = [[NSTask alloc] init];
    ConfigureTask(task, command, args, cwd);

    NSPipe *pipe = [NSPipe pipe];
    [task setStandardOutput:pipe];
    [task setStandardError:pipe];

    NSError *error = nil;
    BOOL success = [task launchAndReturnError:&error];
    
    if (!success) {
        reject(@"launch_error", error.localizedDescription, error);
        return;
    }

    [task waitUntilExit];

    NSData *data = [[pipe fileHandleForReading] readDataToEndOfFile];
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];

    if ([task terminationStatus] == 0) {
        resolve(output);
    } else {
        reject(@"exec_error", output, nil);
    }
}

RCT_EXPORT_METHOD(startServer:(NSString *)command
                  withArgs:(NSArray *)args
                  withCwd:(NSString *)cwd
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (_serverTask && [_serverTask isRunning]) {
        resolve(@"Already running");
        return;
    }

    _serverTask = [[NSTask alloc] init];
    ConfigureTask(_serverTask, command, args, cwd);
    
    NSError *error = nil;
    BOOL success = [_serverTask launchAndReturnError:&error];
    
    if (success) {
        resolve(@"Started");
    } else {
        reject(@"launch_error", error.localizedDescription, error);
    }
}

RCT_EXPORT_METHOD(stopServer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (_serverTask && [_serverTask isRunning]) {
        [_serverTask terminate];
        _serverTask = nil;
        resolve(@"Stopped");
    } else {
        resolve(@"Not running");
    }
}

@end
