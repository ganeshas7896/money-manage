<?php
require 'config.php';
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$a = $_GET['a'] ?? '';
try { $pdo = db(); } catch (Exception $e) { out(['error' => 'Database connection failed'], 500); }

if ($a === 'register') {
    $name = trim($in['name'] ?? ''); $email = strtolower(trim($in['email'] ?? '')); $pw = $in['password'] ?? '';
    if (!$name || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pw) < 6) out(['error' => 'Enter name, valid email and password (min 6 chars)'], 400);
    $s = $pdo->prepare('SELECT id FROM users WHERE email=?'); $s->execute([$email]);
    if ($s->fetch()) out(['error' => 'Email already registered'], 400);
    $pdo->prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT)]);
    session_regenerate_id(true); $_SESSION['uid'] = (int)$pdo->lastInsertId();
    out(['name' => $name]);
}
if ($a === 'login') {
    $s = $pdo->prepare('SELECT * FROM users WHERE email=?'); $s->execute([strtolower(trim($in['email'] ?? ''))]);
    $u = $s->fetch();
    if (!$u || !password_verify($in['password'] ?? '', $u['password'])) out(['error' => 'Wrong email or password'], 401);
    session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id'];
    out(['name' => $u['name']]);
}
if ($a === 'logout') { session_destroy(); out(['ok' => 1]); }

$uid = $_SESSION['uid'] ?? 0;
if ($a === 'me') {
    if (!$uid) out(['user' => null]);
    $s = $pdo->prepare('SELECT name FROM users WHERE id=?'); $s->execute([$uid]);
    out(['user' => $s->fetch()]);
}
if (!$uid) out(['error' => 'Login required'], 401);

if ($a === 'add') {
    $type = $in['type'] ?? ''; $amt = (float)($in['amount'] ?? 0); $date = $in['date'] ?? date('Y-m-d');
    if (!in_array($type, ['income', 'expense']) || $amt <= 0 || !strtotime($date)) out(['error' => 'Invalid data'], 400);
    $pdo->prepare('INSERT INTO transactions(user_id,type,category,amount,note,tx_date) VALUES(?,?,?,?,?,?)')
        ->execute([$uid, $type, substr(trim($in['category'] ?? 'Other'), 0, 40), $amt, substr(trim($in['note'] ?? ''), 0, 200), $date]);
    out(['ok' => 1]);
}
if ($a === 'delete') {
    $pdo->prepare('DELETE FROM transactions WHERE id=? AND user_id=?')->execute([(int)($in['id'] ?? 0), $uid]);
    out(['ok' => 1]);
}
if ($a === 'list') {
    $m = $_GET['m'] ?? '';
    if (preg_match('/^\d{4}-\d{2}$/', $m)) {
        $s = $pdo->prepare('SELECT * FROM transactions WHERE user_id=? AND DATE_FORMAT(tx_date,"%Y-%m")=? ORDER BY tx_date DESC,id DESC');
        $s->execute([$uid, $m]);
    } else {
        $s = $pdo->prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY tx_date DESC,id DESC LIMIT 20');
        $s->execute([$uid]);
    }
    out(['items' => $s->fetchAll()]);
}
if ($a === 'stats') {
    $year = (int)($_GET['y'] ?? date('Y'));
    $q = fn($sql, $p) => ($s = $pdo->prepare($sql)) && $s->execute($p) ? $s->fetchAll() : [];
    $tot = $q('SELECT IFNULL(SUM(CASE WHEN type="income" THEN amount END),0) inc, IFNULL(SUM(CASE WHEN type="expense" THEN amount END),0) exp FROM transactions WHERE user_id=?', [$uid])[0];
    $mon = $q('SELECT MONTH(tx_date) m, SUM(CASE WHEN type="income" THEN amount ELSE 0 END) inc, SUM(CASE WHEN type="expense" THEN amount ELSE 0 END) exp FROM transactions WHERE user_id=? AND YEAR(tx_date)=? GROUP BY m', [$uid, $year]);
    $yrs = $q('SELECT YEAR(tx_date) y, SUM(CASE WHEN type="income" THEN amount ELSE 0 END) inc, SUM(CASE WHEN type="expense" THEN amount ELSE 0 END) exp FROM transactions WHERE user_id=? GROUP BY y ORDER BY y DESC', [$uid]);
    $cat = $q('SELECT category, SUM(amount) amt FROM transactions WHERE user_id=? AND type="expense" AND DATE_FORMAT(tx_date,"%Y-%m")=? GROUP BY category ORDER BY amt DESC', [$uid, date('Y-m')]);
    out(['total' => $tot, 'months' => $mon, 'years' => $yrs, 'cats' => $cat]);
}
out(['error' => 'Unknown action'], 404);
