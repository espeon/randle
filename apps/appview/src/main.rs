use std::net::SocketAddr;

use sqlx::sqlite::SqlitePoolOptions;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

mod api;
mod db;
mod jetstream;
mod scorer;
#[allow(dead_code)]
mod types;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./rngdle.db?mode=rwc".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    tracing::info!("Database initialized");

    let port: u16 = std::env::var("APPVIEW_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3001);

    let app = api::router(pool.clone()).layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("AppView starting on {}", addr);

    let pool_clone = pool.clone();
    tokio::spawn(async move {
        jetstream::run_consumer(pool_clone).await;
    });

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
