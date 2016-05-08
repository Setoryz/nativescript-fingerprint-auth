var keychainItemIdentifier = "TouchIDKey";
var keychainItemServiceName = null;

var available = function () {
  return new Promise(function (resolve, reject) {
    try {
      resolve(
          LAContext.alloc().init().canEvaluatePolicyError(
              LAPolicyDeviceOwnerAuthenticationWithBiometrics, null));
    } catch (ex) {
      console.log("Error in touchid.available: " + ex);
      resolve(false);
    }
  });
};

/**
 * this 'default' method uses keychain instead of localauth so the passcode fallback can be used
 */
var verifyFingerprint = function (arg) {
  return new Promise(function (resolve, reject) {
    try {

      if (keychainItemServiceName === null) {
        var bundleID = NSBundle.mainBundle().infoDictionary.objectForKey("CFBundleIdentifier");
        keychainItemServiceName = bundleID + ".TouchID";
      }

      if (!createKeyChainEntry()) {
        verifyFingerprint(arg);
      } else {
        var message = arg !== null && arg.message || "Scan your finger";
        var query = NSMutableDictionary.alloc().init();
        query.setObjectForKey(kSecClassGenericPassword, kSecClass);
        query.setObjectForKey(keychainItemIdentifier, kSecAttrAccount);
        query.setObjectForKey(keychainItemServiceName, kSecAttrService);
        query.setObjectForKey(message, kSecUseOperationPrompt);

        // Start the query and the fingerprint scan and/or device passcode validation
        var res = SecItemCopyMatching(query, null);
        if (res === 0) { // 0 = ok (match, not canceled)
          resolve();
        } else {
          reject(res);
        }
      }

    } catch (ex) {
      console.log("Error in touchid.verifyFingerprint: " + ex);
      reject(ex);
    }
  });
};

/**
 * This implementation uses LocalAuthentication and has no built-in passcode fallback
 */
var verifyFingerprintWithCustomFallback = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      var laContext = LAContext.alloc().init();
      if (laContext.canEvaluatePolicyError(LAPolicyDeviceOwnerAuthenticationWithBiometrics, null)) {
        var message = arg !== null && arg.message || "Scan your finger";
        if (arg !== null && arg.fallbackMessage) {
          laContext.localizedFallbackTitle = arg.fallbackMessage;
        }
        laContext.evaluatePolicyLocalizedReasonReply(
            LAPolicyDeviceOwnerAuthenticationWithBiometrics,
            message,
            function (ok, error) {
              if (ok) {
                resolve(ok);
              } else {
                reject(error);
              }
            }
        );
      } else {
        reject("Not available");
      }
    } catch (ex) {
      console.log("Error in touchid.verifyFingerprint: " + ex);
      reject(ex);
    }
  });
};

var createKeyChainEntry = function () {
  var attributes = NSMutableDictionary.alloc().init();
  attributes.setObjectForKey(kSecClassGenericPassword, kSecClass);
  attributes.setObjectForKey(keychainItemIdentifier, kSecAttrAccount);
  attributes.setObjectForKey(keychainItemServiceName, kSecAttrService);

  var accessControlRef = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      //kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
      kSecAccessControlUserPresence,
      null
  );
  if (accessControlRef === null) {
    console.log("Can't store identifier '" + keychainItemIdentifier + "' in the KeyChain: " + accessControlError + ".");
    return false;
  } else {
    attributes.setObjectForKey(accessControlRef, kSecAttrAccessControl);
    attributes.setObjectForKey(1, kSecUseNoAuthenticationUI);
    // The content of the password is not important
    var htmlString = NSString.stringWithString("dummy content");
    var nsData = htmlString.dataUsingEncoding(NSUTF8StringEncoding);
    attributes.setObjectForKey(nsData, kSecValueData);

    console.log("keychain attributes: " + attributes);

    SecItemAdd(attributes, null);
    return true;
  }
};

exports.available = available;
exports.verifyFingerprint = verifyFingerprint;
exports.verifyFingerprintWithCustomFallback = verifyFingerprintWithCustomFallback;