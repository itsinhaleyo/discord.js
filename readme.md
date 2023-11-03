# discord.js
YOU WILL NEED TO INSTALL THE LATEST VERISON AVAILABLE OF NPM FROM: https://nodejs.org/en/download

Once NPM has been downloaded,

Open your Terminal and goto the path of the Bot Folder Once it has been downloaded


Run this command in the terminal: npm install -D nodemon

For the .envexample File, remove the "example" from the title so the file is now ".env"

You can delete the NODE_URL and NODE_WEBSOCKET and BANK_KEY if you dont want to include a Web3 Search/Transaction Functions into your bot.

But you should also remove // Call Openai const and "openai" interactionCreate and the name: 'openai' under const commands and const { OpenAI } = require('openai'); in src/index.js


You can also delete OPENAI_KEY and OPENAI_ORG if you dont want to include an OpenAI Query Function into your bot.

But you should also remove "test1" interactionCreate and the name: 'test1' under const commands and const { Web3 } = require('web3'); const web3 = new Web3(Web3.givenProvider || process.env.NODE_WEBSOCKET); in src/index.js

Now for setting up your bot token:

Head to this link https://discord.com/developers/applications to get your Bot Token under Applications > Created Bot > Bot > Token

Add this token id to your .env TOKEN = tokenid


For Setting up Dev id's:

Under discord account settings, scroll to the bottom and click advanced, Turn on Developer Mode.

Now Rightclick your useraccount in a server and Copy User ID,

Add that to your .env beside DEV_ID = 

NOTE: You can add multiple dev id's by adding it into { id, id2, id3, etc }


For setting up Client id:

Make Sure your Bot has been added to a test server of your choosing.

Right Click your bot and Choose Copy User ID

Now add this to your .env beside CLIENT_ID =


For setting up Guild Id:

Right Click the Test server Icon and Copy Server ID,

Add this to your .env beside GUILD_ID = 

NOTE: You can add multiple guild id's by adding it into { id, id2, id3, etc }


For setting up the bot user:

Enter your bots username that will be used beside BOT_USER = 


For Setting Up your DATABASE: https://account.mongodb.com/account/login 

goto the above link and create a new Account

Under Overview once logged in, Create a new Database Deployment

Make Sure to save your Database Login and Password into the .env file Under DB_LOGIN and DB_PASS

Once the Deployment has been created,

Next to DB_NAME = add the name of the deployment you created,

Once all aboce steps have been created Replace the DB_LOGIN, DB_PASS and DB_NAME in the DB_LINK with your added variables.



NOW YOU SHOULD BE ALL SET TO RUN THE BOT!

to run the bot open terminal in the bot folder and enter "nodemon"

this will restart the bot everytime you save a change to the code!