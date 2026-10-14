const path = require('path');
const getAllFiles = require('../utils/getAllFiles');

module.exports = (client) => {
  if (client.eventsLoaded) return;
  const eventFolders = getAllFiles(path.join(__dirname, '..', 'events'), true);
  for (const eventFolder of eventFolders) {
    const eventFiles = getAllFiles(eventFolder);
    eventFiles.sort((a, b) => a > b);
    const eventName = eventFolder.replace(/\\/g, '/').split('/').pop();
    const loadedFunctions = eventFiles.map(file => require(file));
    const listenMethod = eventName === 'ready' ? 'once' : 'on';
    client[listenMethod](eventName, async (...args) => {
      for (const eventFunction of loadedFunctions) {
        try {
          await eventFunction(client, ...args);
        } catch (err) {
          console.error(`Error executing event ${eventName} in file:`, err);
        }
      }
    });
  }
  client.eventsLoaded = true;
};