declare module '@react-native-firebase/messaging' {
  enum AuthorizationStatus {
    NOT_DETERMINED = -1,
    DENIED = 0,
    AUTHORIZED = 1,
    PROVISIONAL = 2,
  }

  interface MessagingInstance {
    requestPermission(): Promise<AuthorizationStatus>;
    getToken(): Promise<string>;
  }

  interface MessagingModule {
    (): MessagingInstance;
    AuthorizationStatus: typeof AuthorizationStatus;
  }

  const messaging: MessagingModule;
  export default messaging;
}
