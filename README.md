# Deployment Instructions for Render

## Quick Deploy to Render

### Option 1: Using GitHub (Recommended)

1. **Push code to GitHub:**
   - Create a new repository on GitHub
   - Push all project files to the repository

2. **Deploy on Render:**
   - Go to [render.com](https://render.com) and sign up/login
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Name**: `youtube-telegram-bot`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free (or upgrade as needed)

3. **Set Environment Variables:**
   - In Render dashboard, go to your service
   - Click "Environment" tab
   - Add environment variable:
     - **Key**: `BOT_TOKEN`
     - **Value**: `8171401104:AAEhvAX56nbSlW2gXblzg--2HtOEl89bwAs`

### Option 2: Using render.yaml (Blueprint)

1. **Upload the render.yaml file** with your code to GitHub
2. **Go to Render Dashboard**
3. **Click "Blueprints"** → "New Blueprint Instance"
4. **Connect your repository** and deploy
5. **Set the BOT_TOKEN** environment variable in the dashboard

## Required Files for Deployment

Make sure you have these files in your repository:

### 1. `package.json`
```json
{
  "name": "youtube-telegram-bot",
  "version": "1.0.0",
  "description": "Telegram bot for downloading YouTube videos",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "yt-dlp-exec": "^1.0.2"
  }
}
```

### 2. `index.js` (Main bot file)
- Your complete bot code with environment variable support

### 3. `render.yaml` (Optional - for Blueprint deployment)
- Configuration file for automatic Render deployment

### 4. `.gitignore`
- Excludes sensitive files and dependencies from Git

## Important Notes

- **Environment Variables**: The bot token is configured via environment variables for security
- **Disk Storage**: Render provides temporary disk storage for video downloads
- **Free Tier**: Render free tier has limitations but works fine for personal use
- **Scaling**: For high traffic, consider upgrading to a paid plan

## Testing Your Deployment

1. Once deployed, check the Render logs to ensure the bot started successfully
2. Send `/start` to your Telegram bot to test functionality
3. Try downloading a YouTube video to verify everything works

## Troubleshooting

- **Bot not responding**: Check Render logs for errors
- **Download failures**: Ensure yt-dlp is properly installed (handled automatically)
- **File size issues**: Videos over 45MB will automatically use lower quality
- **Rate limiting**: Bot has 10-second cooldown per user built-in

Your bot will be accessible 24/7 once deployed 
