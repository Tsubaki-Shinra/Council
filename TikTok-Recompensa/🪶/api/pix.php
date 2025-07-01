<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

function gerarNomeAleatorio() {
    $nomes = ['Ana', 'João', 'Maria', 'Lucas', 'Fernanda', 'Carlos', 'Juliana', 'Rafael', 'Patrícia', 'Bruno'];
    $sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Costa', 'Rodrigues', 'Martins', 'Gomes'];
    return $nomes[array_rand($nomes)] . ' ' . $sobrenomes[array_rand($sobrenomes)];
}

$input = json_decode(file_get_contents('php://input'), true);
$nome = !empty($input['nome']) ? $input['nome'] : gerarNomeAleatorio();
$valor = isset($input['valor']) ? intval($input['valor']) : 1990;
$produto = !empty($input['apiname']) ? $input['apiname'] : 'Produto Sem nome';


$protocolo = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$dominio = $_SERVER['HTTP_HOST'];
$caminho = dirname($_SERVER['REQUEST_URI']);
$postbackUrl = $protocolo . $dominio . $caminho . '/webhook.php';

$payload = [
    "name" => $nome,
    "email" => "teste@example.com",
    "cpf" => "46960142822",
    "phone" => "11999999999",
    "paymentMethod" => "PIX",
    "amount" => $valor,
    "traceable" => true,
    "items" => [
        [
            "unitPrice" => $valor,
            "title" => $produto,
            "quantity" => 1,
            "tangible" => false
        ]
    ],
    "postbackUrl" => $postbackUrl
];

$headers = [
    "Content-Type: application/json",
    "Authorization: a296eacc-a7a3-4016-a946-9e759144bb57"
];

$ch = curl_init("https://pay.zeroonepay.com.br/api/v1/transaction.purchase");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
$resposta = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

file_put_contents('debug_pix_zeroone.txt', json_encode([
    'payload' => $payload,
    'resposta' => $resposta,
    'http_code' => $httpCode
], JSON_PRETTY_PRINT) . PHP_EOL, FILE_APPEND);

$data = json_decode($resposta, true);

if ($httpCode === 200 && isset($data['id'], $data['pixCode'])) {
    echo json_encode([
        "transaction_id" => $data['id'],
        "pix_emv" => $data['pixCode']
    ]);
} else {
    echo json_encode([
        "error" => true,
        "message" => isset($data['message']) ? $data['message'] : 'Erro ao gerar pagamento.'
    ]);
}
