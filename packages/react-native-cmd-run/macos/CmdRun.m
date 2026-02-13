#import "CmdRun.h"
#import <React/RCTLog.h>

@implementation CmdRun {
    NSMutableDictionary<NSString *, NSTask *> *_serverTasks;
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
    [self startNamedServer:@"default"
               withCommand:command
                  withArgs:args
                   withCwd:cwd
                  resolver:resolve
                  rejecter:reject];
}

RCT_EXPORT_METHOD(stopServer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    [self stopNamedServer:@"default" resolver:resolve rejecter:reject];
}

RCT_EXPORT_METHOD(startNamedServer:(NSString *)name
                  withCommand:(NSString *)command
                  withArgs:(NSArray *)args
                  withCwd:(NSString *)cwd
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!_serverTasks) {
        _serverTasks = [NSMutableDictionary dictionary];
    }
    NSString *key = name ?: @"default";
    NSTask *task = _serverTasks[key];
    if (task && [task isRunning]) {
        resolve(@"Already running");
        return;
    }

    task = [[NSTask alloc] init];
    ConfigureTask(task, command, args, cwd);
    NSError *error = nil;
    BOOL success = [task launchAndReturnError:&error];
    if (success) {
        _serverTasks[key] = task;
        resolve(@"Started");
    } else {
        reject(@"launch_error", error.localizedDescription, error);
    }
}

RCT_EXPORT_METHOD(stopNamedServer:(NSString *)name
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!_serverTasks) {
        resolve(@"Not running");
        return;
    }
    NSString *key = name ?: @"default";
    NSTask *task = _serverTasks[key];
    if (task && [task isRunning]) {
        [task terminate];
        [_serverTasks removeObjectForKey:key];
        resolve(@"Stopped");
        return;
    }
    resolve(@"Not running");
}

@end
