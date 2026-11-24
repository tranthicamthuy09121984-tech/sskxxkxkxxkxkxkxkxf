const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        default: "Cuộc trò chuyện mới"
    },
    messages: [{
        role: String,
        content: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Chat", ChatSchema);
