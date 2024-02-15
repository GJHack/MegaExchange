<?php
require 'vendor/autoload.php';

use GuzzleHttp\Psr7;

$TOKEN = "ZXhjaGFuZ2UxYzoyMjIzMzM=";
$TOKEN_STRAPI = "98dbd080c7f62ad3275023c24109b2a6a105a8d9ffe6a8c82bbe4e174a6db4017448e260333d448936df6ea425c7d0fc3f369102f7aa7d3311fc25880fbc488b06b62cfdfe3d6157330857f94c8c89e5edbea4e3539f14c20c2c725d332d7cd8177aaba13f6577a9a3afcd737aa08e4842ed50a547b695f401d52aba1b634611";
$HTTP_PROCOL = "http";
$URL_API = "gruzomir25.ru";
$headers = apache_request_headers();
$authString = $headers["Authorization"];
$authString = explode(" ", $authString);
$authString = $authString[1];


    if(isset($_GET)) {

      if(isset($_GET["mode"]) && $_GET["mode"] != "file") {

           $mode = strval($_GET["mode"]);
           $mode = str_replace (["\r\n", "\n", "\r" , " "], '', $mode);
           $type = $_GET["type"];

           switch($mode) {
                case "checkauth" :

                if($TOKEN != $authString) {

                    echo json_encode([
                      "error" => "Failure",
                      "data" => [$authString, 'SILINTE TOKEN']
                    ]);

                    $fw = fopen($_SERVER["DOCUMENT_ROOT"] . '/exchangeStrapi/log.txt', "a");
                    $result = fwrite($fw, "GET" . var_export(["error" => "$authString : Переданный ключ. Авторизация ложна\n"], true));
                    echo $_SERVER["DOCUMENT_ROOT"] . '/exchangeStrapi/log.txt';
                    fclose($fw);

                    break;

                } else {
                    $fw = fopen($_SERVER["DOCUMENT_ROOT"] . '/exchangeStrapi/log.txt', "a");
                    $result = fwrite($fw, "GET " . var_export(["error" => "$authString : Успешная авторизация\n'"], true));
                    fclose($fw);
                    echo "success\nCookie\ncookie";
                    break;
                }

                case "init" :
                    echo "zip=yes\nfile_limit=54005000";
                    break;

                default:
                    echo("Failure GET");
           }

      }

    }

    if(isset($_POST)) {

      if(isset($_GET["mode"]) && isset($_GET["filename"])) {

           $mode = strval($_GET["mode"]);
           $mode = str_replace (["\r\n", "\n", "\r" , " "], '', $mode);
           $type = ($_GET["type"]) ? $_GET["type"] : "unknown";
           $filename = ($_GET["filename"]) ? $_GET["filename"] : "error_File.zip";

           switch($mode) {
                case "file" :

                    $client = new \GuzzleHttp\Client();
                    $file = file_get_contents('php://input');
                    $url_strapi = $HTTP_PROCOL . "://" . $URL_API . "/exchange/new_files?filename=" . $filename . "&mode=" . $mode;

                    ///usr/share/nginx/html/back/public/uploads/
                    if(!file_exists('/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/' . $filename)){

                        $fw = fopen($_SERVER["DOCUMENT_ROOT"] . '/exchangeStrapi/log.txt', "a");
                        $result = fwrite($fw, "POST: " . var_export(["error" => "$authString : Попытка записи архива на сервер. $filename'"], true));
                        fclose($fw);

                        $result_put = file_put_contents('/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/' . $filename, $file);

                                                     try {
                        $response = $client->get($url_strapi);
                           if ($response->getStatusCode() == 200) {
                                          echo "success";
                           }
                        } catch (Exception $e) {
                                 echo 'Выброшено исключение: ',  $e->getMessage(), "\n";
                        }


                        echo "Файл создан: $filename";

                    } else if (file_exists('/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/' . $filename)) {

                              try {
                                 $response = $client->get($url_strapi);
                                 if ($response->getStatusCode() == 200) {
                                          echo "success";
                                 }
                              } catch (Exception $e) {
                                 echo 'Выброшено исключение: ',  $e->getMessage(), "\n";
                              }


                        echo("Failure Файл уже существует\n");
                        echo("Failure MODE: FILE\n");

                    } else {

                        echo("Failure\n");
                        echo("Непредвиденная ошибка\n");
                        echo("Failure MODE: FILE\n");

                    }





                   echo "success";

                   break;

                default:
                    echo("Failure POST");
           }

      }
   }

// http://localhost/exchangeStrapi/index.php
?>
