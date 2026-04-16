package database

import (
	"database/sql"
	"time"
)

type User struct {
	ID        int
	Email     string
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func CreateUser(email, name string) (*User, error) {
	query := `
		INSERT INTO auth.users (email, name)
		VALUES ($1, $2)
		RETURNING id, email, name, created_at, updated_at`

	user := &User{}
	err := DB.QueryRow(query, email, name).Scan(
		&user.ID, &user.Email, &user.Name, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func GetUserByEmail(email string) (*User, error) {
	query := `SELECT id, email, name, created_at, updated_at 
	          FROM auth.users WHERE email = $1`

	user := &User{}
	err := DB.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.Name, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return user, nil
}

func GetOrCreateUser(email, name string) (*User, error) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return nil, err
	}

	if user != nil {
		return user, nil
	}

	return CreateUser(email, name)
}
