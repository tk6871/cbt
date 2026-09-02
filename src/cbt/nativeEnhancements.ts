export async function initializeNativeEnhancements(): Promise<void> {
  const [{ Keyboard }, { Network }] = await Promise.all([
    import('@capacitor/keyboard'),
    import('@capacitor/network'),
  ]);

  const applyNetwork = (connected: boolean): void => {
    document.documentElement.dataset.network = connected ? 'online' : 'offline';
  };
  applyNetwork((await Network.getStatus()).connected);
  await Network.addListener('networkStatusChange', (status) => applyNetwork(status.connected));
  await Keyboard.addListener('keyboardWillShow', () => {
    document.documentElement.dataset.nativeKeyboard = 'open';
  });
  await Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.dataset.nativeKeyboard = 'closed';
  });
}
