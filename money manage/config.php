<?php
// Edit these for your hosting
const DB_HOST = 'sql213.infinityfree.com';
const DB_NAME = 'if0_43326002_money';
const DB_USER = 'if0_43326002';
const DB_PASS = 'moneymanage1234';

session_start();
header('Content-Type: application/json');

function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }
    return $pdo;
}
function out($data, int $code = 200) { http_response_code($code); echo json_encode($data); exit; }
