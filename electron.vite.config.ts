import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    main: {
        build: {
            outDir: 'dist/main',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/main.ts')
                },
                external: ['../vault-core']
            }
        }
    },
    preload: {
        build: {
            outDir: 'dist/preload',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts')
                }
            }
        }
    },
    renderer: {
        root: 'src',
        build: {
            outDir: 'dist/renderer',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/index.html')
                }
            }
        },
        plugins: [react()]
    }
})
