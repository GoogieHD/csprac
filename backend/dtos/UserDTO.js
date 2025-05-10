class UserDTO {
    constructor(user) {
        this.id = user._id;
        this.username = user.username;
        this.role = user.role;
    }
}

module.exports = UserDTO;
