<?php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$totalSeconds = isset($input['seconds']) ? (int)$input['seconds'] : 0;

if ($totalSeconds <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid time']);
    exit;
}

$timerFile = __DIR__ . '/../../timer.json';
$timerData = [
    'active' => true,
    'endTime' => time() + $totalSeconds,
    'startTime' => time(),
    'duration' => $totalSeconds
];

file_put_contents($timerFile, json_encode($timerData));
echo json_encode(['success' => true]);
