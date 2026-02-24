using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace UmgstClient
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("UMGST C# Client Example");
            string appName = "CSharpApp";
            
            // 1. Launch the App
            LaunchUmgst(appName);

            // 2. Ask for the code
            Console.WriteLine("\nPlease enter the 6-digit code shown in the UMGST app:");
            string code = Console.ReadLine();

            if (!string.IsNullOrWhiteSpace(code))
            {
                ReadAndDecryptToken(code.Trim());
            }
            else
            {
                Console.WriteLine("Code cannot be empty.");
            }
            
            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }

        static void LaunchUmgst(string appName)
        {
            string url = $"umgst://{appName}";
            Console.WriteLine($"Launching UMGST via {url}...");

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to open app automatically: {ex.Message}");
                Console.WriteLine("Please manually launch UMGST if it didn't open.");
            }
        }

        static void ReadAndDecryptToken(string code)
        {
            string userDataPath;
            if (OperatingSystem.IsWindows())
            {
                userDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "umgst");
            }
            else if (OperatingSystem.IsMacOS())
            {
                userDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), "Library", "Application Support", "umgst");
            }
            else // Linux
            {
                userDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Personal), ".config", "umgst");
            }

            string filePath = Path.Combine(userDataPath, "mc_jwt.json");

            if (File.Exists(filePath))
            {
                try
                {
                    string jsonString = File.ReadAllText(filePath);
                    using (JsonDocument doc = JsonDocument.Parse(jsonString))
                    {
                        JsonElement root = doc.RootElement;
                        if (root.TryGetProperty("mc_jwt", out JsonElement jwtElement) && 
                            root.TryGetProperty("iv", out JsonElement ivElement))
                        {
                            string encryptedJwtHex = jwtElement.GetString();
                            string ivHex = ivElement.GetString();

                            string decryptedJwt = Decrypt(encryptedJwtHex, ivHex, code);
                            Console.WriteLine("\n--------------------------------------------------");
                            Console.WriteLine("Decrypted JWT:");
                            Console.WriteLine(decryptedJwt);
                            Console.WriteLine("--------------------------------------------------");
                        }
                        else
                        {
                            Console.WriteLine("Invalid JSON format in mc_jwt.json.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error reading or decrypting file: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine($"Token file not found at: {filePath}");
                Console.WriteLine("Please ensure you have logged in via UMGST.");
            }
        }

        static string Decrypt(string encryptedHex, string ivHex, string code)
        {
            // 1. Derive Key: SHA-256 hash of the 6-digit code
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] key = sha256.ComputeHash(Encoding.UTF8.GetBytes(code));
                
                // 2. Parse IV and Content
                byte[] iv = Convert.FromHexString(ivHex);
                byte[] encryptedBytes = Convert.FromHexString(encryptedHex);

                // 3. Decrypt using custom AES-CTR implementation
                return DecryptAesCtr(encryptedBytes, key, iv);
            }
        }

        static string DecryptAesCtr(byte[] encryptedBytes, byte[] key, byte[] iv)
        {
            // AES-CTR Implementation compatible with Node.js crypto
            using (Aes aes = Aes.Create())
            {
                aes.Key = key;
                aes.Mode = CipherMode.ECB;
                aes.Padding = PaddingMode.None;

                byte[] decryptedBytes = new byte[encryptedBytes.Length];
                byte[] counter = (byte[])iv.Clone();
                
                using (ICryptoTransform encryptor = aes.CreateEncryptor())
                {
                    byte[] keystreamBlock = new byte[16];
                    int outputOffset = 0;

                    // Encrypt the counter to generate the keystream, then XOR with ciphertext
                    while (outputOffset < encryptedBytes.Length)
                    {
                        // Generate 16 bytes of keystream
                        encryptor.TransformBlock(counter, 0, 16, keystreamBlock, 0);

                        // XOR input with keystream
                        int blockSize = Math.Min(16, encryptedBytes.Length - outputOffset);
                        for (int i = 0; i < blockSize; i++)
                        {
                            decryptedBytes[outputOffset + i] = (byte)(encryptedBytes[outputOffset + i] ^ keystreamBlock[i]);
                        }

                        outputOffset += blockSize;

                        // Increment Counter (Big Endian 128-bit integer)
                        IncrementCounter(counter);
                    }
                }

                return Encoding.UTF8.GetString(decryptedBytes);
            }
        }

        static void IncrementCounter(byte[] counter)
        {
            // Increment the 16-byte counter (Big Endian)
            for (int i = counter.Length - 1; i >= 0; i--)
            {
                // Increment byte; if it wraps around to 0, continue to next byte
                if (++counter[i] != 0) break; 
            }
        }
    }
}
