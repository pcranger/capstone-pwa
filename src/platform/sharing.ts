export async function shareAsync(uri: string, _options: unknown) {
  const a = document.createElement("a");
  a.href = uri;
  a.download = "crosswise-session.csv";
  a.click();
}
