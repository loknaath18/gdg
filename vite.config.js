import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'src',
    base: './',
    build: {
        outDir: '../web-dist',
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
