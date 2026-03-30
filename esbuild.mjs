import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['src/extension/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
  bundle: true,
  sourcemap: isWatch,
  logLevel: 'info',
};

const webviewConfig = {
  entryPoints: ['src/webview/index.tsx'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  bundle: true,
  sourcemap: isWatch,
  logLevel: 'info',
  plugins: [
    {
      name: 'css-to-file',
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, async (args) => {
          const css = await fs.promises.readFile(args.path, 'utf8');
          return { contents: css, loader: 'css' };
        });
      },
    },
  ],
};

async function main() {
  try {
    // Copy sql-wasm.wasm to dist/ so sql.js can find it at runtime
    fs.mkdirSync('dist', { recursive: true });
    fs.copyFileSync(
      path.join('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join('dist', 'sql-wasm.wasm')
    );
    if (isWatch) {
      const [extCtx, webCtx] = await Promise.all([
        esbuild.context(extensionConfig),
        esbuild.context(webviewConfig),
      ]);
      await Promise.all([extCtx.watch(), webCtx.watch()]);
      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
      ]);
      console.log('Build complete.');
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
