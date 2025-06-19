const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Main extraction endpoint with improved error handling
app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ 
      success: false, 
      message: 'URL is required' 
    });
  }

  console.log(`📥 Processing URL: ${url}`);

  try {
    // Timeout protection (25 seconds)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Processing timeout exceeded')), 25000)
    );

    const extractionPromise = new Promise((resolve, reject) => {
      // Base command
      let cmd = `yt-dlp --no-playlist --no-warnings -f best --cookies cookies.txt --get-url "${url}"`;

      // Enhanced TikTok handling
      if (url.includes('tiktok.com')) {
        cmd += ` --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
        cmd += ` --add-header "Referer: https://www.tiktok.com/"`;
        cmd += ` --add-header "Origin: https://www.tiktok.com"`;
        cmd += ` --format mp4 --force-generic-extractor`;
      } 
      // Instagram handling
      else if (url.includes('instagram.com')) {
        cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
      }

      exec(cmd, (error, stdout, stderr) => {
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
        
        // Additional TikTok validation
        if (url.includes('tiktok.com') && !directUrl.includes('.mp4')) {
          return reject(new Error('Invalid TikTok video format'));
        }

        resolve({ 
          success: true, 
          url: directUrl 
        });
      });
    });

    // Race between extraction and timeout
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    res.json(result);

  } catch (error) {
    console.error('Extraction failed:', error.message);
    
    // Special handling for TikTok timeouts
    if (url.includes('tiktok.com') && error.message.includes('timeout')) {
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error'
  });
});

// Process error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Perform cleanup if needed
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Server configuration
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Increased timeout settings (30 seconds)
server.timeout = 30000;
server.keepAliveTimeout = 25000;
server.headersTimeout = 26000;

// Log memory usage periodically
setInterval(() => {
  console.log('Memory usage:', process.memoryUsage());
}, 60000); // Every minute
