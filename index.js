const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

// Optional: check yt-dlp and ffmpeg version at boot
exec('yt-dlp --version', (err, stdout) => {
  console.log('yt-dlp version:', stdout.trim());
});
exec('ffmpeg -version', (err, stdout) => {
  console.log('ffmpeg version:', stdout.split('\n')[0]);
});

app.post('/extract', (req, res) => {
  const { url } = req.body;
  console.log(`📥 Received request to extract: ${url}`);

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const timestamp = Date.now();
  const outputPath = path.join(__dirname, 'downloads');
  const outputFile = path.join(outputPath, `video_${timestamp}.mp4`);

  let cmd = `yt-dlp -f best --merge-output-format mp4 -o "${outputFile}" --no-check-certificate`;

  // Add headers for specific platforms
  if (url.includes('tiktok.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.tiktok.com/"`;
  }

  if (url.includes('instagram.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
  }

  cmd += ` "${url}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Extraction error: ${stderr || error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Extraction failed',
        error: stderr || error.message
      });
    }

    console.log(`🔧 yt-dlp stdout: ${stdout}`);
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${req.headers.host}/downloads/video_${timestamp}.mp4`;
    console.log(`✅ Video ready at: ${fileUrl}`);

    res.json({ success: true, url: fileUrl });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Video Downloader API running on http://localhost:${PORT}`);
});
