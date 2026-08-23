#import "CedarlingReactNative.h"
#import "CedarlingReactNative-Swift.h"

static void CedarlingComplete(
  RCTPromiseResolveBlock resolve,
  RCTPromiseRejectBlock reject,
  id _Nullable value,
  NSString * _Nullable code,
  NSString * _Nullable message
) {
  if (code != nil) {
    NSString *description = message ?: @"Cedarling native operation failed";
    NSError *error = [NSError errorWithDomain:@"CedarlingReactNative"
                                         code:1
                                     userInfo:@{NSLocalizedDescriptionKey: description}];
    reject(code, description, error);
    return;
  }
  resolve(value);
}

@interface CedarlingReactNative ()
@property(nonatomic, strong) CedarlingReactNativeBridge *serviceBridge;
@end

@implementation CedarlingReactNative

- (instancetype)init
{
  if (self = [super init]) {
    _serviceBridge = [CedarlingReactNativeBridge new];
  }
  return self;
}

- (void)initialize:(NSString *)bootstrapJson
        archiveUri:(NSString * _Nullable)archiveUri
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge initializeWithBootstrapJson:bootstrapJson archiveUri:archiveUri completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)isInitialized:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge isInitializedWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)authorizeUnsigned:(NSString * _Nullable)principalJson
                   action:(NSString *)action
             resourceJson:(NSString *)resourceJson
              contextJson:(NSString *)contextJson
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge authorizeUnsignedWithPrincipalJson:principalJson action:action resourceJson:resourceJson contextJson:contextJson completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)authorizeMultiIssuer:(NSString *)tokensJson
                      action:(NSString *)action
                resourceJson:(NSString *)resourceJson
                 contextJson:(NSString *)contextJson
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge authorizeMultiIssuerWithTokensJson:tokensJson action:action resourceJson:resourceJson contextJson:contextJson completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getLogIds:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getLogIdsWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getLogById:(NSString *)logId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getLogById:logId completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getLogsByRequestId:(NSString *)requestId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getLogsByRequestId:requestId completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getLogsByRequestIdAndTag:(NSString *)requestId tag:(NSString *)tag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getLogsByRequestId:requestId tag:tag completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getLogsByTag:(NSString *)tag resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getLogsByTag:tag completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)popLogs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge popLogsWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)pushDataContext:(NSString *)key valueJson:(NSString *)valueJson ttlSeconds:(NSNumber *)ttlSeconds resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge pushDataContextWithKey:key valueJson:valueJson ttlSeconds:ttlSeconds completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getDataContext:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getDataContextWithKey:key completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getDataContextEntry:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getDataContextEntryWithKey:key completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)removeDataContext:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge removeDataContextWithKey:key completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)clearDataContext:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge clearDataContextWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)listDataContext:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge listDataContextWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getDataContextStats:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getDataContextStatsWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)isTrustedIssuerLoadedByName:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge isTrustedIssuerLoadedByName:name completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)isTrustedIssuerLoadedByIssuer:(NSString *)issuer resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge isTrustedIssuerLoadedByIssuer:issuer completion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getTrustedIssuerSummary:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getTrustedIssuerSummaryWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)dispose:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge disposeWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)getNativeInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_serviceBridge getNativeInfoWithCompletion:^(id value, NSString *code, NSString *message) {
    CedarlingComplete(resolve, reject, value, code, message);
  }];
}

- (void)invalidate
{
  [_serviceBridge invalidate];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCedarlingReactNativeSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"CedarlingReactNative";
}

@end
