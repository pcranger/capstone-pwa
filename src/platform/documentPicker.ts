export async function getDocumentAsync(
  _options: unknown,
): Promise<{ canceled: boolean; assets: { uri: string; name: string }[] }> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.oncancel = () => resolve({ canceled: true, assets: [] });
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(
        f
          ? {
              canceled: false,
              assets: [{ uri: URL.createObjectURL(f), name: f.name }],
            }
          : { canceled: true, assets: [] },
      );
    };
    input.click();
  });
}
