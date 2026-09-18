// Enveloppe Tauri minimale : charge l'export statique de apps/web (frontendDist).
// Aucune logique métier ici — toute la logique vit dans le backend FastAPI.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Korah Business Manager");
}