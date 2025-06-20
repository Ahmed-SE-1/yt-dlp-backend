const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware setup with request logging
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Serve downloaded videos
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    load: process.cpuUsage()
  };
  res.status(200).json(healthCheck);
});

// Main extraction endpoint with improved performance
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
    const timeoutMs = isTikTok ? 30000 : 20000; // Longer timeout for TikTok
    const result = await Promise.race([
      extractVideoUrl(url, isTikTok, req),
      timeout(timeoutMs, 'Processing timeout exceeded')
    ]);

    res.json(result);
  } catch (error) {
    handleExtractionError(error, res, isTikTok);
  }
});

// Helper functions
async function extractVideoUrl(url, isTikTok, req) {
  const timestamp = Date.now();
  const outputPath = `downloads/video_${timestamp}.mp4`;

  let cmd = `yt-dlp -f best --recode-video mp4 -o "${outputPath}" --no-check-certificate`;

  if (isTikTok) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
    cmd += ` --add-header "Referer: https://www.tiktok.com/"`;
  }

  cmd += ` "${url}"`;

  await execAsync(cmd);

  const fileUrl = `http://${req.headers.host}/${outputPath.replace(/\\/g, '/')}`;
  console.log(`✅ Video downloaded and available at: ${fileUrl}`);

  return {
    success: true,
    url: fileUrl,
    isTikTok: isTikTok
  };
}

function handleExtractionError(error, res, isTikTok) {
  console.error('Extraction failed:', error.message);

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

function timeout(ms, message) {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(message)), ms)
  );
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout });
      }
    });
  });
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error'
  });
});

// Process monitoring
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Server configuration
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Timeout settings
server.timeout = 30000;
server.keepAliveTimeout = 25000;
server.headersTimeout = 26000;

// Performance monitoring
setInterval(() => {
  console.log('Performance metrics:', {
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime()
  });
}, 60000); // Every 60 seconds
