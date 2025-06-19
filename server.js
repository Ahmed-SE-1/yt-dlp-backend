const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const axios = require('axios'); // Added for URL validation

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TikTok-specific configuration
const TIKTOK_CONFIG = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
    'Origin': 'https://www.tiktok.com',
    'Accept-Encoding': 'identity'
  },
  minFileSize: 1024, // 1KB minimum file size
  timeout: 25000 // 25 seconds timeout
};

// Health check endpoint (unchanged)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Main extraction endpoint with enhanced TikTok validation
app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ 
      success: false, 
      message: 'URL is required' 
    });
  }

  console.log(`📥 Processing URL: ${url}`);
  const isTikTok = url.includes('tiktok.com');

  try {
    // Timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Processing timeout exceeded')), TIKTOK_CONFIG.timeout)
    );

    const extractionPromise = new Promise(async (resolve, reject) => {
      try {
        // Base command
        let cmd = `yt-dlp --no-playlist --no-warnings -f best --cookies cookies.txt --get-url "${url}"`;

        // Enhanced TikTok handling
        if (isTikTok) {
          Object.entries(TIKTOK_CONFIG.headers).forEach(([key, value]) => {
            cmd += ` --add-header "${key}: ${value}"`;
          });
          cmd += ` --format mp4 --force-generic-extractor`;
        } 
        // Instagram handling
        else if (url.includes('instagram.com')) {
          cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
        }

        exec(cmd, async (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Extraction error: ${stderr || error.message}`);
            return reject(new Error(stderr || error.message));
          }

          const urls = stdout.trim().split('\n').filter(u => u.startsWith('http'));
          if (urls.length === 0) {
            return reject(new Error('No downloadable video found'));
          }

          const directUrl = urls[0];
          console.log(`✅ Extracted direct URL: ${directUrl}`);
          
          // Enhanced TikTok validation
          if (isTikTok) {
            if (!isValidUrl(directUrl)) {
              return reject(new Error('Invalid TikTok video URL'));
            }
            
            // Additional check for video indicators
            if (!directUrl.includes('.mp4') && !directUrl.includes('mime_type=video_mp4')) {
              return reject(new Error('URL does not point to a valid video file'));
            }
          }

          resolve({ 
            success: true, 
            url: directUrl,
            isTikTok: isTikTok // Maintain original response structure
          });
        });
      } catch (error) {
        reject(error);
      }
    });

    // Race between extraction and timeout
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    res.json(result);

  } catch (error) {
    console.error('Extraction failed:', error.message);
    
    // Special handling for TikTok timeouts
    if (isTikTok && error.message.includes('timeout')) {
      return res.status(504).json({
        success: false,
        message: 'TikTok processing timeout. Please try again.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message.includes('No downloadable') 
        ? 'No video found at this URL' 
        : 'Video extraction failed',
      error: error.message
    });
  }
});

// Helper function to validate URLs (unchanged)
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Error handling middleware (unchanged)
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error'
  });
});

// Process error handlers (unchanged)
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Server configuration (unchanged)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

server.timeout = 30000;
server.keepAliveTimeout = 25000;
server.headersTimeout = 26000;

// Log memory usage periodically (unchanged)
setInterval(() => {
  console.log('Memory usage:', process.memoryUsage());
}, 60000);
