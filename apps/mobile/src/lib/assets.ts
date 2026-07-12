import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';

import { PathService } from '@colanode/client/services';

import emojisDatabaseAsset from '../../assets/emojis.db';
import iconsDatabaseAsset from '../../assets/icons.db';
// Single-file editor-island bundle produced by `npm run build:editor`. Consumed
// by the WebView host (src/island/island-host.tsx) via expo-asset. Gitignored
// output, regenerated on install via `eas-build-post-install`.
import editorHtmlAsset from '../../assets/editor/index.html';

export {
  emojisDatabaseAsset,
  iconsDatabaseAsset,
  editorHtmlAsset,
};

export const copyAssets = async (paths: PathService) => {
  try {
    const assetsDir = new Directory(paths.assets);
    assetsDir.create({ intermediates: true, idempotent: true });

    const fontsDir = new Directory(paths.fonts);
    fontsDir.create({ intermediates: true, idempotent: true });

    await copyAsset(
      Asset.fromModule(emojisDatabaseAsset),
      paths.emojisDatabase
    );
    await copyAsset(Asset.fromModule(iconsDatabaseAsset), paths.iconsDatabase);
  } catch (error) {
    console.error(error);
  }
};

export const copyAsset = async (asset: Asset, path: string) => {
  await asset.downloadAsync();
  const localUri = asset.localUri ?? asset.uri;

  const dest = new File(path);
  if (dest.exists) {
    dest.delete();
  }

  const assetFile = new File(localUri);
  assetFile.copy(dest);
};
