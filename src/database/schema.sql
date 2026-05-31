CREATE DATABASE discordjs;

CREATE TABLE users (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    balance BIGINT NOT NULL,
    daily VARCHAR(100) NOT NULL,
    dailystreak INT NOT NULL DEFAULT 0,
    username VARCHAR(255) NOT NULL,
    avatar VARCHAR(100) NOT NULL,
    xp INT NOT NULL DEFAULT 1,
    level INT NOT NULL DEFAULT 1,
    autoclaim BOOLEAN NOT NULL DEFAULT false,
    autoclaim_expiry DATETIME DEFAULT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    metadata JSON,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (userid, is_read, created_at)
);

CREATE TABLE cooldown (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    command VARCHAR(255) NOT NULL,
    endsAt VARCHAR(100) NOT NULL
);

CREATE TABLE towers (
    userid VARCHAR(100) NOT NULL PRIMARY KEY,
    status VARCHAR(2) NOT NULL,
    bet VARCHAR(20) NOT NULL,
    item1 VARCHAR(5) NOT NULL,
    item2 VARCHAR(5) NOT NULL,
    item3 VARCHAR(5) NOT NULL,
    item4 VARCHAR(5) NOT NULL,
    item5 VARCHAR(5) NOT NULL
);

CREATE TABLE guilds(
    guildid VARCHAR(100) NOT NULL PRIMARY KEY
);

CREATE TABLE portfolios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side ENUM('LONG', 'SHORT') NOT NULL DEFAULT 'LONG',
    leverage INT NOT NULL DEFAULT 1,
    shares DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    average_price DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    margin_used DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    take_profit DECIMAL(18, 8) DEFAULT NULL,
    stop_loss DECIMAL(18, 8) DEFAULT NULL,
    UNIQUE KEY unique_user_position (userid, symbol, side, leverage)
);

CREATE TABLE stock_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side ENUM('LONG', 'SHORT') NOT NULL DEFAULT 'LONG',
    action VARCHAR(50) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    price_per_share DECIMAL(18, 8) NOT NULL,
    total_cost DECIMAL(18, 2) NOT NULL,
    pnl DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    leverage INT NOT NULL DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_history (userid, timestamp DESC)
);

CREATE TABLE gamestatus (
    userid VARCHAR(255) NOT NULL PRIMARY KEY,
    luckyslot INT DEFAULT 1,
    hilow NOT NULL DEFAULT 5
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guildid VARCHAR(255) NOT NULL,
    userid VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE TABLE error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    code VARCHAR(50),
    message TEXT,
    stack TEXT
);

CREATE TABLE lottery_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(255) NOT NULL,
    tickets_bought INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user (userid)
);

CREATE TABLE lottery_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    winner_id VARCHAR(255) NOT NULL,
    winner_username VARCHAR(255) NOT NULL,
    prize_pool INT NOT NULL,
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);