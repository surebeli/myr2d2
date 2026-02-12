#import "LocalModelStorage.h"

@implementation LocalModelStorage

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(getItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSString *value = [[NSUserDefaults standardUserDefaults] stringForKey:key];
    resolve(value);
  } @catch (NSException *exception) {
    reject(@"storage_get_error", exception.reason, nil);
  }
}

RCT_EXPORT_METHOD(setItem:(NSString *)key
                  value:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (value) {
      [[NSUserDefaults standardUserDefaults] setObject:value forKey:key];
    } else {
      [[NSUserDefaults standardUserDefaults] removeObjectForKey:key];
    }
    resolve(@(YES));
  } @catch (NSException *exception) {
    reject(@"storage_set_error", exception.reason, nil);
  }
}

RCT_EXPORT_METHOD(removeItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:key];
    resolve(@(YES));
  } @catch (NSException *exception) {
    reject(@"storage_remove_error", exception.reason, nil);
  }
}

@end

