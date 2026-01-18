export default (): string => {
    return new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
};
