# BhashaLLM

**BhashaLLM** is an advanced AI-powered handwriting recognition system capable of analyzing sketches, image uploads, and real-time camera input. It utilizes Google's **Gemini 2.5 Flash** model to provide high-accuracy OCR, structural analysis, and confidence metrics for handwritten text.

## Features

- **Multi-Modal Input**: 
  - **Sketch**: Draw directly on a digital canvas.
  - **Upload**: Support for PNG/JPG images of handwritten notes.
  - **Camera**: Real-time capture using your device's webcam.
- **AI Analysis**: Powered by Gemini 2.5 Flash for fast and accurate interpretation.
- **Detailed Insights**: Returns recognized text, confidence scores, stroke analysis, and alternative candidates.
- **Themed UI**: Elegant "Skin/Brown" theme built with Tailwind CSS.

## 🚀 How to Run Locally

This project is built with React and TypeScript. To run it on your local machine, we recommend setting up a standard **Vite** environment.

### Prerequisites

1. **Node.js**: Install Node.js (v18+ recommended) from [nodejs.org](https://nodejs.org/).
2. **Gemini API Key**: Get your API key from [Google AI Studio](https://aistudio.google.com/).

### Installation Steps

1. **Create a Vite Project**
   Open your terminal and create a new project:
   ```bash
   npm create vite@latest bhashallm -- --template react-ts
   cd bhashallm
   ```

2. **Install Dependencies**
   Install the required libraries:
   ```bash
   npm install lucide-react recharts @google/genai
   ```
   
   Install Tailwind CSS:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Configure Tailwind CSS**
   Replace the content of `tailwind.config.js` with the following configuration to match the BhashaLLM theme:
   ```javascript
   /** @type {import('tailwindcss').Config} */
   export default {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {
         fontFamily: {
           sans: ['Inter', 'sans-serif'],
           mono: ['JetBrains Mono', 'monospace'],
         },
         colors: {
           slate: {
             50: '#fafaf9',
             100: '#f5f5f4',
             200: '#e7e5e4',
             300: '#d6d3d1',
             400: '#a8a29e',
             500: '#78716c',
             600: '#57534e',
             700: '#44403c',
             800: '#292524',
             850: '#211f1e',
             900: '#1c1917',
             950: '#0c0a09',
           },
           primary: {
             400: '#e8b488',
             500: '#d68c45',
             600: '#a65d24',
           }
         }
       },
     },
     plugins: [],
   }
   ```
   *Note: Ensure you include the fonts (Inter, JetBrains Mono) in your `index.html` or import them via CSS.*

4. **Add Source Code**
   - Copy `App.tsx`, `index.tsx`, `types.ts`, and `metadata.json` into the `src/` folder.
   - Create a `components` folder inside `src/` and place `DrawingCanvas.tsx`, `CameraCapture.tsx`, and `ResultsPanel.tsx` there.
   - Create a `services` folder inside `src/` and place `geminiService.ts` there.

5. **Configure API Key**
   The application uses `process.env.API_KEY`. You must configure Vite to define this variable.
   
   Create a `.env` file in the root:
   ```env
   VITE_API_KEY=your_actual_api_key_here
   ```

   Update `vite.config.ts`:
   ```typescript
   import { defineConfig, loadEnv } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig(({ mode }) => {
     const env = loadEnv(mode, process.cwd(), '');
     return {
       plugins: [react()],
       define: {
         'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
       }
     }
   })
   ```

6. **Run the App**
   ```bash
   npm run dev
   ```
   Open the link provided (usually `http://localhost:5173`) in your browser.

## Troubleshooting

- **Camera Permissions**: Ensure your browser has permission to access the webcam.
- **API Errors**: If analysis fails, check your console logs. Ensure your API key is valid and has access to the `gemini-2.5-flash` model.

## License

MIT License
