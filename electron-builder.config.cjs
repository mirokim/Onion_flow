/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.onion-flow.app',
  productName: 'ONION FLOW',
  copyright: 'Copyright © 2026 mirokim',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'public/onion.svg',
  ],
  fileAssociations: [
    {
      ext: 'onionflow',
      name: 'Onion Flow Project',
      description: 'Onion Flow Project File',
      role: 'Editor',
    },
  ],
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ONION FLOW',
    uninstallDisplayName: 'ONION FLOW',
  },
  mac: {
    target: ['dmg'],
    icon: 'build/icon.png',
    category: 'public.app-category.productivity',
  },
  linux: {
    target: ['AppImage', 'deb'],
    icon: 'build/icon.png',
    category: 'Office',
  },
}
