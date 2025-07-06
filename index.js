const TelegramBot = require('node-telegram-bot-api');
const ytdlp = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8171401104:AAEhvAX56nbSlW2gXblzg--2HtOEl89bwAs';
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45MB in bytes
const DOWNLOAD_DIR = './downloads';

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Rate limiting
const userLastRequest = new Map();
const RATE_LIMIT_MS = 10000; // 10 seconds

function isRateLimited(userId) {
    const now = Date.now();
    const lastRequest = userLastRequest.get(userId);
    
    if (lastRequest && (now - lastRequest) < RATE_LIMIT_MS) {
        return true;
    }
    
    userLastRequest.set(userId, now);
    return false;
}

function isYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
    return youtubeRegex.test(url);
}

async function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up file: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error cleaning up file ${filePath}:`, error);
    }
}

async function getVideoInfo(url) {
    try {
        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noDownload: true,
            quiet: true
        });

        return {
            title: info.title || 'Unknown',
            duration: info.duration || 0,
            uploader: info.uploader || 'Unknown',
            viewCount: info.view_count || 0,
            description: (info.description || '').substring(0, 200) + (info.description && info.description.length > 200 ? '...' : '')
        };
    } catch (error) {
        console.error('Error getting video info:', error);
        return null;
    }
}

async function downloadVideo(url, chatId) {
    try {
        const outputTemplate = path.join(DOWNLOAD_DIR, `${chatId}_%(title)s.%(ext)s`);
        
        const output = await ytdlp(url, {
            output: outputTemplate,
            format: 'best[filesize<45M]/best[height<=720]/best',
            noPlaylist: true,
            quiet: true,
            noWarnings: true
        });

        // Find the downloaded file
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(file => file.startsWith(`${chatId}_`));
        
        if (files.length === 0) {
            throw new Error('No file downloaded');
        }

        const downloadedFile = path.join(DOWNLOAD_DIR, files[0]);
        const stats = fs.statSync(downloadedFile);

        if (stats.size > MAX_FILE_SIZE) {
            // Try downloading in lower quality
            fs.unlinkSync(downloadedFile);
            return await downloadLowerQuality(url, chatId);
        }

        return downloadedFile;
    } catch (error) {
        console.error('Error downloading video:', error);
        return null;
    }
}

async function downloadLowerQuality(url, chatId) {
    try {
        const outputTemplate = path.join(DOWNLOAD_DIR, `${chatId}_low_%(title)s.%(ext)s`);
        
        await ytdlp(url, {
            output: outputTemplate,
            format: 'worst[filesize<40M]/worst[height<=480]/worst',
            noPlaylist: true,
            quiet: true,
            noWarnings: true
        });

        // Find the downloaded file
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(file => file.startsWith(`${chatId}_low_`));
        
        if (files.length === 0) {
            throw new Error('No file downloaded');
        }

        const downloadedFile = path.join(DOWNLOAD_DIR, files[0]);
        const stats = fs.statSync(downloadedFile);

        if (stats.size > MAX_FILE_SIZE) {
            fs.unlinkSync(downloadedFile);
            return null;
        }

        return downloadedFile;
    } catch (error) {
        console.error('Error downloading lower quality video:', error);
        return null;
    }
}

// Bot command handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `🎬 Welcome to YouTube Video Downloader Bot! 🎬

📝 How to use:
• Send me any YouTube URL
• I'll download and send you the video
• Videos are limited to 45MB due to Telegram restrictions

⚡ Commands:
/start - Show this welcome message
/help - Get help and usage instructions

🚀 Just send me a YouTube link to get started!`;

    bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `🆘 YouTube Downloader Bot Help 🆘

📋 Instructions:
1. Copy a YouTube video URL
2. Send it to me in this chat
3. Wait for the download to complete
4. Receive your video file!

⚠️ Important Notes:
• File size limit: 45MB (Telegram restriction)
• Supported formats: MP4, WebM, MKV, AVI
• Rate limit: 1 video per 10 seconds
• Only YouTube URLs are supported

🔗 Supported URL formats:
• https://youtube.com/watch?v=...
• https://youtu.be/...
• https://m.youtube.com/watch?v=...

❓ Having issues? Make sure your URL is valid and try again!`;

    bot.sendMessage(chatId, helpMessage);
});

// Handle messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Skip commands
    if (text && text.startsWith('/')) {
        return;
    }

    // Check if message contains text
    if (!text) {
        return;
    }

    // Check rate limiting
    if (isRateLimited(userId)) {
        bot.sendMessage(chatId, '⏳ Please wait a moment before sending another request. Rate limit: 1 video per 10 seconds.');
        return;
    }

    // Check if message contains a YouTube URL
    if (!isYouTubeUrl(text)) {
        bot.sendMessage(chatId, `❌ Please send a valid YouTube URL.

Supported formats:
• https://youtube.com/watch?v=...
• https://youtu.be/...
• https://m.youtube.com/watch?v=...`);
        return;
    }

    try {
        // Send typing action
        bot.sendChatAction(chatId, 'typing');

        // Get video info first
        await bot.sendMessage(chatId, '🔍 Checking video information...');
        const videoInfo = await getVideoInfo(text);

        if (!videoInfo) {
            bot.sendMessage(chatId, '❌ Could not retrieve video information. Please check the URL and try again.');
            return;
        }

        // Show video info
        const infoText = `📹 Video Info:
Title: ${videoInfo.title}
Uploader: ${videoInfo.uploader}
Duration: ${videoInfo.duration} seconds
Views: ${videoInfo.viewCount.toLocaleString()}

⬇️ Starting download...`;

        await bot.sendMessage(chatId, infoText);

        // Send upload action
        bot.sendChatAction(chatId, 'upload_video');

        // Download video
        const downloadedFile = await downloadVideo(text, chatId);

        if (!downloadedFile) {
            bot.sendMessage(chatId, `❌ Download failed. This could be due to:
• Video is too large (>45MB)
• Video is private or restricted
• Network issues
• Invalid URL

Please try again with a different video.`);
            return;
        }

        // Check file size
        const stats = fs.statSync(downloadedFile);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (stats.size > MAX_FILE_SIZE) {
            bot.sendMessage(chatId, `❌ Video is too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
            await cleanupFile(downloadedFile);
            return;
        }

        // Send the video file
        await bot.sendMessage(chatId, `📤 Uploading video (${fileSizeMB.toFixed(1)}MB)...`);

        await bot.sendVideo(chatId, downloadedFile, {
            caption: `🎬 ${videoInfo.title}\n📊 Size: ${fileSizeMB.toFixed(1)}MB`,
            supports_streaming: true
        });

        await bot.sendMessage(chatId, '✅ Video sent successfully!');

        // Clean up the file
        await cleanupFile(downloadedFile);

    } catch (error) {
        console.error('Error processing video:', error);
        bot.sendMessage(chatId, '❌ An error occurred while processing your request. Please try again later or contact support if the issue persists.');
        
        // Clean up any partial downloads
        try {
            const files = fs.readdirSync(DOWNLOAD_DIR).filter(file => file.startsWith(`${chatId}_`));
            files.forEach(file => {
                fs.unlinkSync(path.join(DOWNLOAD_DIR, file));
            });
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

// Start the bot
console.log('🤖 YouTube Telegram Bot is starting...');
console.log('📝 Bot token configured');
console.log('📁 Downloads directory:', DOWNLOAD_DIR);
console.log('📏 Max file size:', MAX_FILE_SIZE / (1024 * 1024), 'MB');
console.log('✅ Bot is running and ready to receive messages!');
