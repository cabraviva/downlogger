export default (): string => {
    const now = new Date();
    return now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
};
