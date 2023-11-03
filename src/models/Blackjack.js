const { Schema, model } =  require('mongoose');

const blackjackSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    guildId: {
        type: String,
        required: true,
    },
    State: {
        type: Number,
        default: 0,
        required: true,
    },
    card1: {
        type: String,
        default: "0",
    },
    card2: {
        type: String,
        default: "0",
    },
    card3: {
        type: String,
        default: "0",
    },
    card4: {
        type: String,
        default: "0",
    }
});

module.exports = model('Blackjack', blackjackSchema);