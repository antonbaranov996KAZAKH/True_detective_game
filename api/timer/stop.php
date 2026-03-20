<?php
header('Content-Type: application/json');

$timerFile = __DIR__ . '/../../timer.json';
$timerData = [
    'active' => false,
    'endTime' => null,
    'startTime' => null,
    'duration' => 0
];

file_put_contents($timerFile, json_encode($timerData));
echo json_encode(['success' => true]);
