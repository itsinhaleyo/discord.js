const { Schema, model } =  require('mongoose');

const towersSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    guildId: {
        type: String,
        required: true,
    },
    status: {
        type: Number,
        default: 0,
        required: true,
    },
    Item1: {
        type: Number,
        default: 1,
    },
    Item2: {
        type: Number,
        default: 1,
    },
    Item3: {
        type: Number,
        default: 1,
    },
    Item4: {
        type: Number,
        default: 1,
    },
    Item5: {
        type: Number,
        default: 1,
    },
    Item6: {
        type: Number,
        default: 1,
    },
    Item7: {
        type: Number,
        default: 1,
    },
    Item8: {
        type: Number,
        default: 1,
    },
    Item9: {
        type: Number,
        default: 1,
    }
});

module.exports = model('Towers', towersSchema);