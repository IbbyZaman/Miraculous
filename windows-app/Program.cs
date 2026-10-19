using System;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

namespace MiraculousHubWindows;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new HubWindow());
    }
}

public sealed class HubWindow : Form
{
    private const string Home = "https://miraculoushub.co.uk/";
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    private readonly Label message = new()
    {
        Text = "✦  MiraculousHub  •  Loading…",
        Dock = DockStyle.Top, Height = 32, ForeColor = Color.White,
        BackColor = Color.FromArgb(43, 22, 48), TextAlign = ContentAlignment.MiddleCenter
    };
    public HubWindow()
    {
        Text = "MiraculousHub";
        MinimumSize = new Size(780, 500);
        Size = new Size(1230, 800);
        BackColor = Color.FromArgb(5, 7, 12);
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(browser);
        Controls.Add(message);
        Shown += async (_, _) =>
        {
            try
            {
                await browser.EnsureCoreWebView2Async();
                browser.CoreWebView2.Settings.AreDevToolsEnabled = true;
                browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                browser.CoreWebView2.NavigationStarting += (_, e) => message.Text = "✦  MiraculousHub  •  Loading…";
                browser.CoreWebView2.NavigationCompleted += (_, e) =>
                    message.Text = e.IsSuccess ? "✦  MiraculousHub" : "⚠  Website unavailable — press Ctrl+R to retry";
                browser.CoreWebView2.ProcessFailed += (_, _) =>
                    message.Text = "⚠  Web content crashed — press Ctrl+R to reload";
                browser.CoreWebView2.Navigate(Home);
            }
            catch (Exception ex)
            {
                message.Text = "Could not start Microsoft Edge WebView2: " + ex.Message;
            }
        };
        KeyPreview = true;
        KeyDown += (_, e) =>
        {
            if (e.Control && e.KeyCode == Keys.R)
            {
                if (browser.CoreWebView2 != null) browser.CoreWebView2.Reload();
                e.SuppressKeyPress = true;
            }
            else if (e.Alt && e.KeyCode == Keys.Left && browser.CanGoBack)
            {
                browser.GoBack(); e.SuppressKeyPress = true;
            }
            else if (e.Alt && e.KeyCode == Keys.Right && browser.CanGoForward)
            {
                browser.GoForward(); e.SuppressKeyPress = true;
            }
        };
    }
}