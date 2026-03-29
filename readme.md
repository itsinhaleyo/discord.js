# discord.js

YOU WILL NEED TO INSTALL THE LATEST VERISON AVAILABLE OF NPM FROM: https://nodejs.org/en/download

Once NPM has been downloaded,

Open your Terminal and goto the path of the Bot Folder Once it has been downloaded


Run this command in the terminal: npm install -D nodemon

For the .envexample File, remove the "example" from the title so the file is now ".env"

You can also delete GEMINI_API_KEY if you dont want to include an Google Gemini Query Function into your bot.

Now for setting up your bot token:

Head to this link https://discord.com/developers/applications to get your Bot Token under Applications > Created Bot > Bot > Token

Add this token id to your .env TOKEN = tokenid


For setting up the bot user:

Enter your bots username that will be used beside BOT_USER = 


For Setting Up your DATABASE: use MySQL


NOW YOU SHOULD BE ALL SET TO RUN THE BOT!

to run the bot open terminal in the bot folder and enter "nodemon index.js"

and if nodemon doesnt work use this line "npx nodemon index.js"

this will restart the bot everytime you save a change to the code!