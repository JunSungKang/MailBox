// Read-only protocol probe. Run in a disposable container with the consumer's
// exact image/network namespace and read-only CA/password file mounts.
// It never issues MAIL, RCPT or DATA and never prints credentials/responses.
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import javax.net.ssl.*;

class ClientConnectionProbe {
    static BufferedReader reader;
    static BufferedWriter writer;
    static boolean advertisedAuth;
    static int response() throws IOException {
        String line; int code = -1; advertisedAuth = false;
        do {
            line = reader.readLine();
            if (line == null || line.length() < 4) throw new IOException("SMTP response unavailable");
            code = Integer.parseInt(line.substring(0, 3));
            advertisedAuth |= line.substring(4).startsWith("AUTH");
        } while (line.charAt(3) == '-');
        return code;
    }
    static void attach(Socket socket) throws IOException {
        reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
        writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
    }
    static int command(String value) throws IOException { writer.write(value + "\r\n"); writer.flush(); return response(); }
    static void require(boolean value) throws IOException { if (!value) throw new IOException("Protocol contract rejected"); }
    public static void main(String[] args) {
        try {
            String host = System.getenv("PROBE_HOST");
            int port = Integer.parseInt(System.getenv("PROBE_PORT"));
            var store = KeyStore.getInstance(KeyStore.getDefaultType()); store.load(null, null);
            try (var in = Files.newInputStream(Path.of("/run/probe/ca.pem"))) {
                store.setCertificateEntry("consumer-ca", CertificateFactory.getInstance("X.509").generateCertificate(in));
            }
            var trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()); trust.init(store);
            var context = SSLContext.getInstance("TLS"); context.init(null, trust.getTrustManagers(), null);
            try (var raw = new Socket()) {
                raw.connect(new InetSocketAddress(host, port), 5000); raw.setSoTimeout(10000); attach(raw);
                require(response() == 220); require(command("EHLO consumer-probe.invalid") == 250); require(!advertisedAuth);
                require(command("STARTTLS") == 220);
                try (var tls = (SSLSocket) context.getSocketFactory().createSocket(raw, host, port, true)) {
                    tls.setEnabledProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
                    var parameters = tls.getSSLParameters(); parameters.setEndpointIdentificationAlgorithm("HTTPS"); tls.setSSLParameters(parameters);
                    tls.startHandshake(); attach(tls); require(command("EHLO consumer-probe.invalid") == 250); require(advertisedAuth);
                    String password = Files.readString(Path.of("/run/probe/password"));
                    String auth = Base64.getEncoder().encodeToString(("\0" + System.getenv("PROBE_USER") + "\0" + password).getBytes(StandardCharsets.UTF_8));
                    require(command("AUTH PLAIN " + auth) == 235); require(command("QUIT") == 221);
                }
            }
        } catch (Exception failure) {
            System.exit(1);
        }
    }
}
