package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	mux := newMux()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("listening %s (static=%s)", addr, staticDir())
	log.Fatal(http.ListenAndServe(addr, mux))
}

func staticDir() string {
	dir := os.Getenv("STATIC_DIR")
	if dir == "" {
		dir = "../web/dist"
	}
	return dir
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "ok")
	})
	mux.HandleFunc("/api/run", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handleRun(w, r)
	})
	mux.Handle("/", http.FileServer(http.Dir(staticDir())))
	return mux
}
