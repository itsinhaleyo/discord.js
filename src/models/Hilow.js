const { Schema, model } =  require('mongoose');

const hilowSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    lastNumber: {
        type: Number,
        default: 5
    }
});

module.exports = model('Hilow', hilowSchema);