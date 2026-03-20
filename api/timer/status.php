<?php
header('Content-Type: application/json');

$timerFile = __DIR__ . '/../../timer.json';

if (!file_exists($timerFile)) {
    echo json_encode(['active' => false, 'timeLeft' => 0]);
    exit;
}

$timerData = json_decode(file_get_contents($timerFile), true);

if ($timerData['active'] && $timerData['endTime']) {
    $timeLeft = max(0, $timerData['endTime'] - time());
    if ($timeLeft <= 0) {
        $timerData['active'] = false;
        file_put_contents($timerFile, json_encode($timerData));
        echo json_encode(['active' => false, 'timeLeft' => 0]);
    } else {
        echo json_encode(['active' => true, 'timeLeft' => $timeLeft]);
    }
} else {
    echo json_encode(['active' => false, 'timeLeft' => 0]);
}
