from flask import Flask, jsonify, request
try:
    from .storage import storage
except ImportError:
    from storage import storage

def register_routes(app: Flask):
    # API routes for players
    @app.route("/api/players", methods=["GET"])
    def get_players():
        try:
            players = storage.get_players()
            return jsonify(players)
        except Exception as error:
            return jsonify({"message": "Failed to fetch players"}), 500

    @app.route("/api/players/<int:id>", methods=["GET"])
    def get_player(id):
        try:
            player = storage.get_player(id)
            
            if not player:
                return jsonify({"message": "Player not found"}), 404
            
            return jsonify(player)
        except Exception as error:
            return jsonify({"message": "Failed to fetch player"}), 500
    
    # API routes for skills
    @app.route("/api/skills/<int:player_id>", methods=["GET"])
    def get_skills(player_id):
        try:
            skills = storage.get_skills(player_id)
            
            if not skills:
                return jsonify({"message": "Skills not found for player"}), 404
            
            return jsonify(skills)
        except Exception as error:
            return jsonify({"message": "Failed to fetch skills"}), 500
    
    # API routes for challenges
    @app.route("/api/challenges", methods=["GET"])
    def get_challenges():
        try:
            challenges = storage.get_challenges()
            return jsonify(challenges)
        except Exception as error:
            return jsonify({"message": "Failed to fetch challenges"}), 500

    @app.route("/api/challenges/<int:id>", methods=["GET"])
    def get_challenge(id):
        try:
            challenge = storage.get_challenge(id)
            
            if not challenge:
                return jsonify({"message": "Challenge not found"}), 404
            
            return jsonify(challenge)
        except Exception as error:
            return jsonify({"message": "Failed to fetch challenge"}), 500