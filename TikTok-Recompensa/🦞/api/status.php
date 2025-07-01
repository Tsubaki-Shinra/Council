<?php

if (!isset($_GET['id'])) {
    echo json_encode(["error" => true, "message" => "ID não informado"]);
    exit;
}

$id = $_GET['id'];

$headers = [
    "Content-Type: application/json",
    "Authorization: a296eacc-a7a3-4016-a946-9e759144bb57"
];

$url = "https://pay.zeroonepay.com.br/api/v1/transaction.getPayment?id=" . urlencode($id);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
$resposta = curl_exec($ch);
curl_close($ch);

$data = json_decode($resposta, true);

if (isset($data['status'])) {
    echo json_encode(["status" => $data['status']]);
} else {
    echo json_encode(["error" => true, "message" => "Erro ao consultar status"]);
}
