
function test(e) {
    console.log("アプリ起動");
    const rec = $app.findRecordById("users", "olz5mbcr6im8el1");
    const email = rec.get("email");
    console.log(email);
    //
}

module.exports = {
    test,
}