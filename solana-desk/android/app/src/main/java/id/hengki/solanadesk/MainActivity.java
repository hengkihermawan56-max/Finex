package id.hengki.solanadesk;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME = ORIGIN + "/assets/index.html";
    private static final int EXPORT_REQUEST = 31;
    private WebView web;
    private String pendingCsv;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(10,16,18));
        setContentView(web);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(false);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && "appassets.androidplatform.net".equals(url.getHost())) return false;
                if (request.isForMainFrame() && "https".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (Exception ignored) { Toast.makeText(MainActivity.this, "Browser tidak tersedia.", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        // This bridge only offers the OS file-save dialog for CSV text. It does
        // not expose arbitrary files, wallet signing, network calls or commands.
        web.addJavascriptInterface(new CsvExport(), "AndroidExport");
        web.loadUrl(HOME);
    }

    public final class CsvExport {
        @JavascriptInterface public void saveCsv(final String csv) {
            if (csv == null || csv.length() > 8_000_000) return;
            runOnUiThread(() -> {
                if (web == null || web.getUrl() == null || !web.getUrl().startsWith(ORIGIN + "/assets/")) return;
                if (pendingCsv != null) return;
                pendingCsv = csv;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/csv");
                intent.putExtra(Intent.EXTRA_TITLE, "HENGKI-Solana-Jurnal.csv");
                try { startActivityForResult(intent, EXPORT_REQUEST); }
                catch (Exception ignored) { pendingCsv = null; Toast.makeText(MainActivity.this, "Pemilih file tidak tersedia.", Toast.LENGTH_LONG).show(); }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST) return;
        String csv = pendingCsv; pendingCsv = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || csv == null) return;
        try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
            if (output == null) throw new IllegalStateException("Output unavailable");
            output.write(csv.getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "Jurnal CSV disimpan.", Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) { Toast.makeText(this, "Jurnal belum berhasil disimpan.", Toast.LENGTH_LONG).show(); }
    }

    @Override protected void onPause() {
        if (web != null) { web.evaluateJavascript("window.HengkiDesk && window.HengkiDesk.pauseForBackground()", null); web.onPause(); }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.HengkiDesk && window.HengkiDesk.resumeForeground()", null); }
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("AndroidExport"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
